import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';

@Injectable({
  providedIn: 'root'
})
export class RequestDataService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {  }

  createForUser(session_id: string, link: string, username: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/requests/user`, { session_id, link, username });
  }
  createForEveryone(session_id: string, link: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/requests/everyone`, { session_id, link });
  }
  check(session_id: string, link: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/requests/check`, { session_id, link });
  }
  accept(session_id: string, link: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/requests/accept`, { session_id, link });
  }
  decline(session_id: string, link: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/requests/decline`, { session_id, link });
  }
}