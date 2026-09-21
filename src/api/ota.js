import request from '../utils/request'

// Upload file - uploads a file to the server and returns file access URL
// Request body: FormData with file field
// Response: { data: { file_url: string }, message: string }
export const upload = (data) => {
	return request({
		url: '/api/v1/host/file/upload',
		method: 'post',
		data
	})
}
// Fetch OTA list - retrieves all OTA configuration items from sys_conf table
// Response: { data: { ota_configs: [...] }, message: string }
export const fetchOTAList = (params) => {
	return request({
		url: '/api/v1/host/admin/ota/list',
		method: 'get',
		params
	})
}
// Deploy OTA configuration - deploys OTA configuration to all connected hosts
// Updates sys_conf table and broadcasts message to all connected hosts
// Request body: { id: number, conf_name: string, conf_val: string, ...other_config_fields }
// Response: { data: { affected_hosts: number }, message: string }
export const deploy = (data) => {
	return request({
		url: '/api/v1/host/admin/ota/deploy',
		method: 'post',
		data
	})
}
