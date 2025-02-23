import axios from 'axios';
import { Paper } from './types';

const API_BASE_URL = 'https://huggingface.co/api/daily_papers';

// Exponential backoff retry mechanism
const axiosWithRetry = axios.create();
axiosWithRetry.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  if (!config || !response) {
    return Promise.reject(error);
  }

  config.retryCount = config.retryCount ?? 0;
  const shouldRetry = config.retryCount < 3;

  if (shouldRetry) {
    config.retryCount += 1;
    const delay = Math.pow(2, config.retryCount) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return axiosWithRetry(config);
  }

  return Promise.reject(error);
});

export const fetchPapers = async (): Promise<Paper[]> => {
  try {
    const response = await axiosWithRetry.get(`${API_BASE_URL}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching papers:', error);
    throw error;
  }
};