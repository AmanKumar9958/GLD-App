import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Spinner } from '../components/ui/spinner'
import { fetchStudents } from '../services/courseService'

export const Students = () => {
  const PAGE_SIZE = 7
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await fetchStudents()
        setStudents(data)
      } catch (err) {
        setError(err.message || 'Failed to load students')
      } finally {
        setLoading(false)
      }
    }

    loadStudents()
  }, [])

  const rows = useMemo(
    () =>
      students.map((student) => {
        const name = student.full_name || student.name || student.fullName || 'N/A'
        const email = student.email || student.mail || 'N/A'
        const createdValue = student.created_at || student.createdAt || student.accountCreatedAt

        let created = 'N/A'
        if (createdValue) {
          const parsed = new Date(createdValue)
          if (!Number.isNaN(parsed.getTime())) {
            created = parsed.toLocaleString()
          }
        }

        return {
          id: student.id,
          name,
          email,
          created,
          imageUrl:
            student.avatar_url ||
            student.imageUrl ||
            student.photoURL ||
            student.profileImage ||
            '',
        }
      }),
    [students],
  )


  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage(1)
  }, [rows.length])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [currentPage, rows])

  const startItem = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endItem = Math.min(currentPage * PAGE_SIZE, rows.length)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Students</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-gray-600">No students found in DB.</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Account Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    {student.imageUrl ? (
                      <img
                        src={student.imageUrl}
                        alt={student.name}
                        className="h-10 w-10 rounded-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
                        {student.name !== 'N/A'
                          ? student.name
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() || '')
                              .join('') || 'NA'
                          : 'NA'}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.created}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            <p>
              Showing {startItem}-{endItem} of {rows.length} students
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, index) => {
                const pageNumber = index + 1
                const isActive = pageNumber === currentPage

                return (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`rounded-md px-3 py-1.5 ${
                      isActive
                        ? 'bg-gray-900 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                )
              })}
              <button
                type="button"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
