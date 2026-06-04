import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
  providedIn: 'root'
})
export class SessionDataService {
  constructor(private http: HttpClient) {  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/sessions/login`, { email, password });
  }
  logout(session_id: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/logout`, { session_id });
  }
  closeAll(session_id: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/close-all`, { session_id });
  }
  closeOther(session_id: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/close-other`, { session_id });
  }
  checkActive(session_id: string): Observable<boolean> {
    return this.http.post<boolean>(`${environment.apiUrl}/sessions/check-active`, { session_id });
  }
  get(session_id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/sessions/get`, { session_id });
  }
}