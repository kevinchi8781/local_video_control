import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 配置 API
export const configApi = {
  getConfig: () => api.get('/config'),
  saveConfig: (data: { ffmpegPath?: string; folderBindings?: Array<{ id: string; path: string; displayName: string }> }) => api.post('/config', data),
  addFolder: (path: string) => api.post('/config/folder', { path }),
  removeFolder: (id: string) => api.delete(`/config/folder/${id}`)
};

// 文件夹 API
export const folderApi = {
  getRootFolders: () => api.get('/folders'),
  getChildren: (id: string, path: string) => api.get(`/folders/${id}/children`, { params: { path } })
};

// 视频 API
export const videoApi = {
  getVideos: (params: {
    page?: number;
    limit?: number;
    folderPath?: string;
    search?: string;
    durationMin?: number;
    durationMax?: number;
    sortBy?: string;
    sortOrder?: string;
  }) => api.get('/videos', { params }),
  getVideo: (id: string) => api.get(`/videos/${id}`),
  getStreamUrl: (id: string) => `${API_BASE}/videos/${id}/stream`,
  reportProgress: (id: string, progressSeconds: number, isCompleted: boolean) =>
    api.post(`/videos/${id}/progress`, { progressSeconds, isCompleted })
};

// 历史记录 API
export const historyApi = {
  getHistory: (limit?: number) => api.get('/history', { params: { limit } }),
  getContinueWatching: (limit?: number) => api.get('/history/continue', { params: { limit } })
};

// 扫描 API
export const scanApi = {
  startScan: () => api.post('/scan'),
  getStatus: () => api.get('/scan/status')
};

// 收藏 API
export const collectionApi = {
  getAll: () => api.get('/collections'),
  getAllCategories: () => api.get('/collections/categories'),
  create: (data: { name: string; description?: string }) => api.post('/collections', data),
  update: (id: string, data: { name?: string; description?: string }) => api.put(`/collections/${id}`, data),
  delete: (id: string) => api.delete(`/collections/${id}`),
  getVideos: (collectionId: string, params?: { page?: number; limit?: number; categoryId?: string; search?: string }) =>
    api.get(`/collections/${collectionId}/videos`, { params }),
  addVideo: (collectionId: string, videoId: string, data?: { categoryId?: string; customCategories?: string[]; note?: string }) =>
    api.post(`/collections/${collectionId}/videos`, { videoId, ...data }),
  removeVideo: (collectionId: string, videoId: string) =>
    api.delete(`/collections/${collectionId}/videos/${videoId}`),
  checkFavorite: (videoId: string) => api.get(`/collections/check/${videoId}`),
  addToFavorites: (videoId: string, data?: { categoryId?: string; customCategories?: string[]; note?: string }) =>
    api.post(`/collections/videos/${videoId}/favorite`, data),
  removeFromFavorites: (videoId: string) => api.delete(`/collections/videos/${videoId}/favorite`)
};

// 分类 API
export const categoryApi = {
  getAll: () => api.get('/categories'),
  getTree: () => api.get('/categories/tree'),
  create: (data: { name: string; parentId?: string; description?: string; color?: string; icon?: string }) =>
    api.post('/categories', data),
  update: (id: string, data: { name?: string; description?: string; color?: string; icon?: string }) =>
    api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
  getVideoCount: (id: string) => api.get(`/categories/${id}/video-count`)
};

export default api;
