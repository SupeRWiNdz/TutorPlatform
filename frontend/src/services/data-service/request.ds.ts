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

  create(session_id: string, link: string, username?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/requests/create`, { session_id, link, username });
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