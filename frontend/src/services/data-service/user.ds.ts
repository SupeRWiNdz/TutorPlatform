import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {  }

  getUserData(sessionId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/get-user-data`, { session_id: sessionId });
  }
  changePassword(session_id: string, old_password: string, new_password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/change-password`, { session_id, old_password, new_password });
  }
  getProfile(username: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/info/${username}`);
  }
}