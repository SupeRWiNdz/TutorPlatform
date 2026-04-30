import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  constructor(private http: HttpClient) { }

  getUserData(sessionId: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/users/get-user-data`, { session_id: sessionId });
  }
  changePassword(session_id: string, old_password: string, new_password: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/users/change-password`, { session_id, old_password, new_password });
  }
  getProfile(username: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/users/info/${username}`);
  }
  editUser(data: {
    session_id: string,
    new_email?: string,
    new_username?: string,
    new_full_name?: string,
    new_phone?: string,
    new_birth_date?: string
  }): Observable<any> {
    const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    return this.http.post<any>(`${environment.apiUrl}/users/edit`, filteredData);
  }
  register(userData: {
    account_type: string,
    email: string,
    password: string,
    phone?: string,
    username: string,
    birth_date?: string,
    full_name: string
  }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/users/register`, userData);
  }

}