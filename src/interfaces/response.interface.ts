export interface IResponse {
  status: 'success' | 'fail';
  statusCode: number;
  message: string;
  data?: any;
  error?: any;
  meta?: {
    count?: number;
    totalPages?: number;
    currentPage?: number;
    limit?: number;
  };
}
