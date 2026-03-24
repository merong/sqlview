import { useState, useEffect, useCallback } from 'react'
import { getComments, saveComment, type CommentsData } from '@/lib/api'

export function useComments(dbPath: string | null) {
  const [comments, setComments] = useState<CommentsData>({ tables: {}, columns: {} })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dbPath) {
      setComments({ tables: {}, columns: {} })
      return
    }
    let cancelled = false
    setLoading(true)
    getComments(dbPath)
      .then((res) => { if (!cancelled) setComments(res.comments) })
      .catch(() => { if (!cancelled) setComments({ tables: {}, columns: {} }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dbPath])

  const updateComment = useCallback(
    async (target: 'table' | 'column', key: string, comment: string) => {
      if (!dbPath) return
      const res = await saveComment(dbPath, target, key, comment)
      setComments(res.comments)
    },
    [dbPath]
  )

  return { comments, loading, updateComment }
}
