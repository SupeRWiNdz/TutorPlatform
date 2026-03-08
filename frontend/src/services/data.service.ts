import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  public  apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/login`, { email, password });
  }

  getUserData(sessionId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/get-user-data`, { session_id: sessionId });
  }

  logout(session_id: string) {
    return this.http.post(`${this.apiUrl}/users/logout`, { session_id });
  }

  closeAllSessions(session_id: string) {
    return this.http.post(`${this.apiUrl}/users/close-all-sessions`, { session_id });
  }
  
  closeOtherSessions(session_id: string) {
    return this.http.post(`${this.apiUrl}/users/close-other-sessions`, { session_id });
  }

  checkActiveSession(session_id: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.apiUrl}/users/check-active-session`, { session_id });
  }

  changePassword(session_id: string, old_password: string, new_password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/change-password`, { session_id, old_password, new_password });
  }

  getProfile(username: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/profile/${username}`);
  }

  getMessages(session_id: string, receiver_username: string, message_count?: number, before_number?: number): Observable<any> {
    const payload: any = { session_id, receiver_username, message_count };
    if (before_number) {
      payload.before_number = before_number;
    }
    return this.http.post<any>(`${this.apiUrl}/messages/get`, payload);
  }

  getNewMessages(session_id: string, receiver_username: string, after_number: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/messages/get-new`, { session_id, receiver_username, after_number });
  }

  sendMessage(session_id: string, receiver_username: string, text: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/messages/send`, { session_id, receiver_username, text });
  }

  getChats(session_id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/messages/chats`, { session_id });
  }
}