import { catchError, Observable, timeout, TimeoutError } from 'rxjs';
import { BadRequestException, HttpException, HttpStatus, RequestTimeoutException } from '@nestjs/common';

export function handleTimeoutAndErrors<T = unknown>() {
    return (source$: Observable<T>) =>
        source$.pipe(
            timeout(5000),
            catchError((err) => {
                if (err instanceof TimeoutError) {
                    throw new HttpException(err.message, HttpStatus.REQUEST_TIMEOUT);
                }
                throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
            }),
        );
}
