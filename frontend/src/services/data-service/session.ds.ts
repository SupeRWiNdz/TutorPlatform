import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
  providedIn: 'root'
})
export class SessionDataService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sessions/login`, { email, password });
  }
  logout(session_id: string) {
    return this.http.post(`${this.apiUrl}/sessions/logout`, { session_id });
  }
  closeAllSessions(session_id: string) {
    return this.http.post(`${this.apiUrl}/sessions/close-all-sessions`, { session_id });
  }
  closeOtherSessions(session_id: string) {
    return this.http.post(`${this.apiUrl}/sessions/close-other-sessions`, { session_id });
  }
  checkActiveSession(session_id: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.apiUrl}/sessions/check-active-session`, { session_id });
  }
}