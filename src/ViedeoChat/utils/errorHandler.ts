// 错误处理工具函数

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
}

export function handleError(error: unknown, defaultMessage: string): string {
  const message = getErrorMessage(error);
  return message || defaultMessage;
}

