import { Inject, Injectable, OnInit, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, tap } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { FormGroup } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class AdvertisementsService {
  private advertisementsSubject: BehaviorSubject<any[] | null>;
  public advertisements$: Observable<any[] | null>;
  private myAdvertisementsSubject: BehaviorSubject<any[] | null>;
  public myAdvertisements$: Observable<any[] | null>;
  private myCreatedClassesSubject: BehaviorSubject<any[] | null>;
  public myCreatedClasses$: Observable<any[] | null>;

  constructor(
    private dataService: DataService,
    private auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.advertisementsSubject = new BehaviorSubject<any | null>(null);
    this.advertisements$ = this.advertisementsSubject.asObservable();
    this.myAdvertisementsSubject = new BehaviorSubject<any | null>(null);
    this.myAdvertisements$ = this.myAdvertisementsSubject.asObservable();
    this.myCreatedClassesSubject = new BehaviorSubject<any | null>(null);
    this.myCreatedClasses$ = this.myCreatedClassesSubject.asObservable();

    this.getAdvertisements().subscribe();
    this.getMyAdvertisements().subscribe();
    this.myCreatedClasses().subscribe();
  }

  public clearState(): void {
    this.advertisementsSubject.next(null);
    this.myAdvertisementsSubject.next(null);
  }

  public loadAdvertisements(searchValue?: string): Observable<any> { return this.getAdvertisements(searchValue); }

  private getAdvertisements(searchValue?: string): Observable<any> {
    return this.dataService.advertisementDS.get((this.pageIndex*this.PAGE_SIZE).toString(), this.PAGE_SIZE.toString(), searchValue).pipe(
      tap(response => {
        this.advertisementsSubject.next(response);
      }),
      catchError(() => of(null))
    );
  }

  private getMyAdvertisements(): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);
    return this.dataService.advertisementDS.getMy(sessionId).pipe(
      tap(response => {
        this.myAdvertisementsSubject.next(response);
      }),
      catchError(() => of(null))
    );
  }
  private myCreatedClasses(): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);
    return this.dataService.classDS.myCreatedClasses(sessionId).pipe(
      tap(response => {
        this.myCreatedClassesSubject.next(response);
      }),
      catchError(() => of(null))
    );
  }
  public submitForm(formValue: FormGroup, advertisementID: string | null = null, mode: string | null = null, link: string | null = null): Observable<any> {
    const { name, price, description } = formValue.value;
    if (mode == 'create' && link) { return this.create(name, link, price, description); }
    else if (mode == 'edit' && advertisementID) { return this.edit(advertisementID, name, price, description); }
    return of(null);
  }
  private create(name: string, link: string, price: string, description: string): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId)
      return of(null);
    return this.dataService.advertisementDS.create(sessionId, link, description, price, name).pipe(
      tap(() => {
        this.getAdvertisements().subscribe();
        this.getMyAdvertisements().subscribe();
      }),
      catchError(() => of(null))
    );
  }
  private edit(advertisementID: string, name: string, price: string, description: string): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);
    return this.dataService.advertisementDS.edit(sessionId, advertisementID, description, price, name).pipe(
      tap(() => {
        this.getAdvertisements().subscribe();
        this.getMyAdvertisements().subscribe();
      }),
      catchError(() => of(null))
    );
  }

  public archiveAdvertisement(ad_id: string): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);
    return this.dataService.advertisementDS.archive(sessionId, ad_id).pipe(
      tap(() => {
        this.getAdvertisements().subscribe();
        this.getMyAdvertisements().subscribe();
      }),
      catchError(() => of(null))
    );
  }
  public removeAdvertisement(ad_id: string): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId) return of(null);
    return this.dataService.advertisementDS.remove(sessionId, ad_id).pipe(
      tap(() => {
        this.getAdvertisements().subscribe();
        this.getMyAdvertisements().subscribe();
      }),
      catchError(() => of(null))
    );
  }
  public classInfo(ad_id: string | null): Observable<any> {
    const sessionId = this.auth.tokenValue;
    if (!sessionId || !ad_id) return of(null);
    return this.dataService.advertisementDS.getClass(sessionId, ad_id);
  }

  public readonly PAGE_SIZE: number = 10; 
  public pageIndex: number = 0;
}