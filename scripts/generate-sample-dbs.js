import fs from 'node:fs';
import path from 'node:path';
import { Database } from 'bun:sqlite';

const projectRoot = path.resolve(import.meta.dirname, '..');
const fixturesDir = path.join(projectRoot, 'fixtures');

fs.mkdirSync(fixturesDir, { recursive: true });

const outputs = [
  createShopDatabase(path.join(fixturesDir, 'sample_shop.db')),
  createBlogDatabase(path.join(fixturesDir, 'sample_blog.db'))
];

process.stdout.write(JSON.stringify(outputs, null, 2) + '\n');

function createShopDatabase(filePath) {
  safeUnlink(filePath);
  const db = new Database(filePath);

  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      segment TEXT NOT NULL,
      city TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      stock_qty INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      order_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      ordered_at TEXT NOT NULL,
      shipped_at TEXT,
      total_cents INTEGER NOT NULL
    );

    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE inventory_movements (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      movement_type TEXT NOT NULL,
      quantity_delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );

    CREATE VIEW v_order_summary AS
      SELECT
        o.id,
        o.order_number,
        c.name AS customer_name,
        c.segment,
        o.status,
        o.ordered_at,
        o.total_cents,
        COUNT(oi.id) AS line_count
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, o.order_number, c.name, c.segment, o.status, o.ordered_at, o.total_cents;

    CREATE VIEW v_low_stock_products AS
      SELECT id, sku, name, category, stock_qty, status
      FROM products
      WHERE stock_qty <= 12
      ORDER BY stock_qty ASC, name ASC;

    CREATE INDEX idx_customers_email ON customers(email);
    CREATE INDEX idx_orders_ordered_at ON orders(ordered_at DESC);
    CREATE INDEX idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX idx_products_category_status ON products(category, status);
    CREATE INDEX idx_inventory_movements_product_time ON inventory_movements(product_id, occurred_at DESC);
  `);

  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, email, segment, city, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertProduct = db.prepare(`
    INSERT INTO products (sku, name, category, price_cents, status, stock_qty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOrder = db.prepare(`
    INSERT INTO orders (customer_id, order_number, status, ordered_at, shipped_at, total_cents)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, discount_cents)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertInventoryMovement = db.prepare(`
    INSERT INTO inventory_movements (product_id, movement_type, quantity_delta, reason, occurred_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const customerNames = [
    'Alice Kim', 'Brian Choi', 'Chloe Park', 'Daniel Lee', 'Eun Seo Han', 'Felix Jung',
    'Grace Moon', 'Hanna Yoo', 'Ian Kang', 'Jin Woo Lim', 'Kelly Shin', 'Luna Kwon',
    'Minho Ryu', 'Nara Song', 'Owen Bae', 'Pauline Kim', 'Ryan Cho', 'Sora Jeon'
  ];
  const customerSegments = ['retail', 'pro', 'wholesale'];
  const cities = ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju'];
  customerNames.forEach((name, index) => {
    insertCustomer.run(
      name,
      slugify(name) + '@example.com',
      customerSegments[index % customerSegments.length],
      cities[index % cities.length],
      dateFromOffset(index + 2, '09:00:00'),
      index % 4 === 0 ? null : dateFromOffset(index, '18:30:00')
    );
  });

  const productSeeds = [
    ['MON-001', '4K Monitor 27"', 'display'],
    ['MON-002', 'Ultrawide Monitor 34"', 'display'],
    ['KEY-001', 'Mechanical Keyboard', 'accessory'],
    ['KEY-002', 'Silent Keyboard', 'accessory'],
    ['MOU-001', 'Gaming Mouse', 'accessory'],
    ['MOU-002', 'Wireless Mouse', 'accessory'],
    ['LAP-001', 'Developer Laptop 14"', 'computer'],
    ['LAP-002', 'Lightweight Laptop 13"', 'computer'],
    ['DOC-001', 'USB-C Dock', 'accessory'],
    ['CAB-001', 'USB-C Cable', 'cable'],
    ['CAB-002', 'HDMI Cable', 'cable'],
    ['SSD-001', 'Portable SSD 1TB', 'storage'],
    ['SSD-002', 'Portable SSD 2TB', 'storage'],
    ['TAB-001', 'Tablet 11"', 'mobile'],
    ['PHN-001', 'Team Phone', 'mobile'],
    ['CAM-001', 'Conference Camera', 'office'],
    ['MIC-001', 'Desk Microphone', 'office'],
    ['SPK-001', 'Desktop Speaker Set', 'office'],
    ['CHA-001', 'Ergo Chair', 'furniture'],
    ['DSK-001', 'Standing Desk', 'furniture'],
    ['LAM-001', 'Desk Lamp', 'furniture'],
    ['ROU-001', 'Wi-Fi Router', 'network'],
    ['HUB-001', 'USB Hub', 'accessory'],
    ['BAG-001', 'Laptop Sleeve', 'accessory']
  ];
  productSeeds.forEach((seed, index) => {
    const [sku, name, category] = seed;
    insertProduct.run(
      sku,
      name,
      category,
      3500 + index * 2200,
      index % 7 === 0 ? 'backorder' : 'active',
      6 + (index * 5) % 37,
      dateFromOffset(index + 10, '10:15:00')
    );
  });

  const selectPrice = db.prepare('SELECT price_cents FROM products WHERE id = ?');
  for (let orderId = 1; orderId <= 42; orderId += 1) {
    const customerId = ((orderId - 1) % customerNames.length) + 1;
    const status = ['processing', 'paid', 'shipped', 'cancelled'][orderId % 4];
    const orderedAt = dateFromOffset(60 - orderId, '14:20:00');
    const shippedAt = status === 'shipped' ? dateFromOffset(59 - orderId, '11:10:00') : null;
    let totalCents = 0;

    insertOrder.run(
      customerId,
      'ORD-' + String(2026000 + orderId),
      status,
      orderedAt,
      shippedAt,
      0
    );

    const lineCount = 2 + (orderId % 3);
    for (let line = 0; line < lineCount; line += 1) {
      const productId = ((orderId * 3 + line * 5) % productSeeds.length) + 1;
      const priceRow = selectPrice.get(productId);
      const unitPrice = priceRow ? priceRow.price_cents : 1000;
      const quantity = 1 + ((orderId + line) % 4);
      const discount = (orderId + line) % 5 === 0 ? 500 : 0;
      totalCents += quantity * unitPrice - discount;
      insertOrderItem.run(orderId, productId, quantity, unitPrice, discount);
    }

    db.prepare('UPDATE orders SET total_cents = ? WHERE id = ?').run(totalCents, orderId);
  }

  for (let movementId = 1; movementId <= 72; movementId += 1) {
    const productId = ((movementId - 1) % productSeeds.length) + 1;
    const inbound = movementId % 4 === 0;
    insertInventoryMovement.run(
      productId,
      inbound ? 'in' : 'out',
      inbound ? 10 + (movementId % 7) : -1 * (1 + (movementId % 5)),
      inbound ? 'restock' : 'order_allocation',
      dateFromOffset(40 - Math.floor(movementId / 2), '08:45:00')
    );
  }

  const summary = collectSummary(db, filePath, {
    customers: 'customers',
    products: 'products',
    orders: 'orders',
    order_items: 'order_items',
    inventory_movements: 'inventory_movements'
  });

  db.close();
  return summary;
}

function createBlogDatabase(filePath) {
  safeUnlink(filePath);
  const db = new Database(filePath);

  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL
    );

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES authors(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      published_at TEXT,
      view_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE comments (
      id INTEGER PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      commenter_name TEXT NOT NULL,
      body TEXT NOT NULL,
      is_approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE post_tags (
      post_id INTEGER NOT NULL REFERENCES posts(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      PRIMARY KEY (post_id, tag_id)
    );

    CREATE VIEW v_published_posts AS
      SELECT
        p.id,
        p.title,
        a.name AS author_name,
        p.published_at,
        p.view_count,
        COUNT(c.id) AS comment_count
      FROM posts p
      JOIN authors a ON a.id = p.author_id
      LEFT JOIN comments c ON c.post_id = p.id AND c.is_approved = 1
      WHERE p.status = 'published'
      GROUP BY p.id, p.title, a.name, p.published_at, p.view_count;

    CREATE VIEW v_comment_queue AS
      SELECT c.id, p.title, c.commenter_name, c.created_at
      FROM comments c
      JOIN posts p ON p.id = c.post_id
      WHERE c.is_approved = 0
      ORDER BY c.created_at DESC;

    CREATE INDEX idx_posts_status_published_at ON posts(status, published_at DESC);
    CREATE INDEX idx_comments_post_id ON comments(post_id);
    CREATE INDEX idx_post_tags_tag_id ON post_tags(tag_id);
  `);

  const insertAuthor = db.prepare(`
    INSERT INTO authors (name, email, role, joined_at)
    VALUES (?, ?, ?, ?)
  `);
  const insertPost = db.prepare(`
    INSERT INTO posts (author_id, title, slug, status, published_at, view_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertComment = db.prepare(`
    INSERT INTO comments (post_id, commenter_name, body, is_approved, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
  const insertPostTag = db.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)');

  const authors = [
    ['Mina Park', 'editor'],
    ['Doyun Lee', 'writer'],
    ['Hyejin Song', 'writer'],
    ['Chris Park', 'guest'],
    ['Yuna Kim', 'analyst'],
    ['Noah Choi', 'editor']
  ];
  authors.forEach((entry, index) => {
    insertAuthor.run(entry[0], slugify(entry[0]) + '@blog.example.com', entry[1], dateFromOffset(180 - index * 9, '09:30:00'));
  });

  const tags = ['sqlite', 'nodejs', 'cli', 'testing', 'ui', 'sql', 'performance', 'tooling'];
  tags.forEach((tag) => insertTag.run(tag));

  for (let postId = 1; postId <= 24; postId += 1) {
    const authorId = ((postId - 1) % authors.length) + 1;
    const status = postId % 5 === 0 ? 'draft' : (postId % 4 === 0 ? 'review' : 'published');
    const title = 'Sample article ' + postId;
    const publishedAt = status === 'published' ? dateFromOffset(90 - postId, '07:45:00') : null;
    insertPost.run(authorId, title, 'sample-article-' + postId, status, publishedAt, 120 + postId * 37);

    insertPostTag.run(postId, ((postId - 1) % tags.length) + 1);
    insertPostTag.run(postId, ((postId + 2) % tags.length) + 1);
  }

  for (let commentId = 1; commentId <= 96; commentId += 1) {
    const postId = ((commentId - 1) % 24) + 1;
    insertComment.run(
      postId,
      'Reader ' + commentId,
      'This is sample feedback #' + commentId + ' for post ' + postId + '.',
      commentId % 4 === 0 ? 0 : 1,
      dateFromOffset(70 - Math.floor(commentId / 3), '20:05:00')
    );
  }

  const summary = collectSummary(db, filePath, {
    authors: 'authors',
    posts: 'posts',
    comments: 'comments',
    tags: 'tags',
    post_tags: 'post_tags'
  });

  db.close();
  return summary;
}

function collectSummary(db, filePath, tables) {
  const counts = {};
  for (const [key, tableName] of Object.entries(tables)) {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`).get();
    counts[key] = row ? row.count : 0;
  }

  return {
    file: path.relative(projectRoot, filePath).split(path.sep).join('/'),
    counts
  };
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
}

function dateFromOffset(daysAgo, timeText) {
  const now = new Date('2026-03-10T12:00:00Z');
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const isoDate = date.toISOString().slice(0, 10);
  return `${isoDate}T${timeText}Z`;
}

function safeUnlink(targetPath) {
  try {
    fs.unlinkSync(targetPath);
  } catch {
    // Ignore missing files.
  }
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
