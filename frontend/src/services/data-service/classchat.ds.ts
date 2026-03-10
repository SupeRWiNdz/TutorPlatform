import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
  providedIn: 'root'
})
export class ClasschatDataService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {  }

  getMessages(session_id: string, receiver_link: string, message_count?: number, before_number?: number): Observable<any> {
    const payload: any = { session_id, receiver_link, message_count };
    if (before_number) {
      payload.before_number = before_number;
    }
    return this.http.post<any>(`${this.apiUrl}/classchat/get`, payload);
  }
  getNewMessages(session_id: string, receiver_link: string, after_number: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/classchat/get-new`, { session_id, receiver_link, after_number });
  }
  sendMessage(session_id: string, receiver_link: string, text: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/classchat/send`, { session_id, receiver_link, text });
  }
}