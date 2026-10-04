import { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types/api.types';

export function getApiErrorStatus(error: unknown) {
    return error instanceof AxiosError ? error.response?.status : undefined;
}

export function getApiErrorMessage(
    error: unknown,
    fallback = 'Có lỗi xảy ra, vui lòng thử lại.'
) {
    if (error instanceof AxiosError) {
        const data = error.response?.data as ApiErrorResponse | undefined;
        return data?.message ?? fallback;
    }
    return error instanceof Error ? error.message : fallback;
}
