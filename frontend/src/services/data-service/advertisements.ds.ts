import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
  providedIn: 'root'
})
export class AdvertisementsDataService {
  constructor(private http: HttpClient) { }

  create(session_id: string, class_link: string, description: string, price: string, name: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/advertisements/create`, { session_id, class_link, description, price, name });
  }
  edit(session_id: string, ad_id: string, description: string, price: string, name: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/advertisements/edit`, { session_id, ad_id, description, price, name });
  }
  remove(session_id: string, ad_id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/advertisements/remove`, { session_id, ad_id });
  }
  archive(session_id: string, ad_id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/advertisements/archive`, { session_id, ad_id });
  }
  get(before_number: string, ads_count: string, search?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/advertisements/get`, { before_number, search, ads_count });
  }
  getMy(session_id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/advertisements/get-my`, { session_id });
  }
  getClass(session_id: string, advertisement_id: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/advertisements/get-class`, { session_id, advertisement_id});
  }
  getByUsername(username: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/advertisements/get-by-username/${username}`);
  }
}