import request from '../utils/request'

// Upload file - uploads a file to server directory and returns file access URL
// Request body: FormData with file field
// Headers: Content-Type: 'multipart/form-data'
// Response: { data: { file_url: string }, message: string }
export const uploadFile = (data) => {
  return request({
    timeout: 100 * 1000,
    url: '/api/v1/host/file/upload',
    headers: { 'Content-Type': 'multipart/form-data' },
    method: 'post',
    data
  })
}

// Fetch file URL - retrieves uploaded file content with support for range requests (resume download)
// Path parameter: filename - name of the file to retrieve
// Supports Range header for resume download functionality
// Response: File content with appropriate status codes (200, 206, 404, 416)
export const fetchFileUrl = (filename) => {
  return request({
    url: `/api/v1/host/file/${filename}`,
    method: 'get'
  })
}
