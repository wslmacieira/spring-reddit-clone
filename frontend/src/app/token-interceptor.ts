import { AuthService } from './auth/shared/auth.service';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { BehaviorSubject, Observable, throwError } from "rxjs";
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { LoginResponse } from './auth/login/login-response.payload';
import { Injectable } from '@angular/core';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  isTokenRefreshing = false;
  refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject(null);

  constructor(public authService: AuthService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const jwtToken: string = this.authService.getJwtToken();
    if (jwtToken) {
      this.addToken(req, jwtToken);
    }
    return next.handle(req).pipe(catchError(error => {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        return this.handlerAuthErrors(req, next);
      } else {
        return throwError(error);
      }
    }))
  }

  private handlerAuthErrors(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
      if (!this.isTokenRefreshing) {
          this.isTokenRefreshing = true;
          this.refreshTokenSubject.next(null);

          return this.authService.refreshToken().pipe(
              switchMap((refreshTokenResponse: LoginResponse) => {
                  this.isTokenRefreshing = false;
                  this.refreshTokenSubject
                      .next(refreshTokenResponse.authenticationToken);
                  return next.handle(this.addToken(req,
                      refreshTokenResponse.authenticationToken));
              })
          )
      } else {
          return this.refreshTokenSubject.pipe(
              filter(result => result !== null),
              take(1),
              switchMap((res) => {
                  return next.handle(this.addToken(req,
                      this.authService.getJwtToken()))
              })
          );
      }
  }
  addToken(req: HttpRequest<any>, jwtToken: string) {
    return req.clone({
      setHeaders: { Authorization: 'Bearer ' + jwtToken }
    });
  }
}
