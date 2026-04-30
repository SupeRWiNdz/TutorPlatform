import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { MatMenuModule } from '@angular/material/menu';
import { BehaviorSubject, catchError, Observable, of, tap } from 'rxjs';
import { DataService } from '@services/data.service';
import { AuthService } from '@services/auth.service';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, RouterModule,
    MatButtonModule, MatIconModule, TruncatePipe, MatMenuModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private advertisementsSubject: BehaviorSubject<any[] | null>;
  public advertisements$: Observable<any[] | null>;
  public advertisementsList: any = null;
  public advertisementForm: FormGroup;
  public selectedAdvertisementID: string | null = null;
  private _mode: 'view' | null = null;
  public get mode() { return this._mode }
  public viewMode(id: string): void {
    if (this.advertisementToForm(id))
      this._mode = 'view';
  }
  public noMode(): void {
    this.advertisementForm.reset();
    this._mode = null;
  }
  user: any | null = null;
  public isTitleActive: number = 50;

  constructor(private route: ActivatedRoute,
    private fb: FormBuilder,
    private dataService: DataService) {
    this.advertisementsSubject = new BehaviorSubject<any | null>(null);
    this.advertisements$ = this.advertisementsSubject.asObservable();
    this.advertisementForm = this.fb.group({
      name: [''],
      price: [''],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.user = data['profile'];
      this.getAdvertisements().subscribe();
      this.advertisements$.subscribe(response => this.advertisementsList = response);
    });
  }
  private getAdvertisements(): Observable<any> {
    return this.dataService.advertisementDS.getByUsername(this.user.username).pipe(
      tap(response => {
        this.advertisementsSubject.next(response.advertisements);
      }),
      catchError(() => of(null))
    );
  }

private advertisementToForm(id: string): boolean {
  if (!this.advertisementsList || !Array.isArray(this.advertisementsList)) {
    return false;
  }

  const found = this.advertisementsList.find((ad: any) => ad.id === id);

  if (found) {
    this.advertisementForm.patchValue({
      name: found.name || '',
      price: found.price ?? '',
      description: found.description || ''
    });
    this.selectedAdvertisementID = id;
    return true;
  }

  return false;
}

  public showTitle(): void {
    if (this.isTitleActive == 50)
      this.isTitleActive = -1;
    else
      this.isTitleActive = 50;
  }
}
