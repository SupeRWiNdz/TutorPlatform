import { AsyncPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { AdvertisementsService } from '@services/advertisements.service';
import { map, Observable } from 'rxjs';
import { MatFormField, MatLabel, MatError } from "@angular/material/form-field";
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { AuthService } from '@services/auth.service';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { RouterLink } from "@angular/router";

@Component({
  selector: 'advertisements',
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule, MatFormField, MatLabel, MatError, MatInputModule,
    MatButtonModule, MatIconModule, MatMenuModule, MatSelectModule, MatPaginatorModule, FormsModule, TruncatePipe, RouterLink],
  templateUrl: './advertisements.html',
  styleUrl: './advertisements.scss',
})
export class Advertisements implements OnInit, OnDestroy {
  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
  public advertisements$: Observable<any | null>;
  public myAdvertisements$: Observable<any | null>;
  public myCreatedClasses$: Observable<any | null>;
  public classInfo$: Observable<any> | null = null;
  public advertisementsList: any = null;
  public myAdvertisementsList: any = null;
  public myCreatedClassesList: any = null;
  public advertisementForm: FormGroup;
  public selectClassForm: FormGroup;
  public searchForm: FormGroup;
  public selectedAdvertisementID: string | null = null;
  public selectedAdvertisementUsername: string | null = null;
  public isAuth$: Observable<boolean>;
  public isBrowser: boolean;

  private _mode: 'search' | 'my' | 'view' | 'create' | 'edit' = 'search';
  public get mode() { return this._mode }
  public viewMode(id: string): void {
    if (this.advertisementToForm(id, 'search'))
      this._mode = 'view';
  }
  public createMode(): void {
    this.advertisementForm.reset();
    this.selectClassForm.reset();
    this._mode = 'create';
  }
  public editMode(id: string): void {
    if (!this.advertisementToForm(id, 'my')) return;
    this.classInfo$ = this.advertisementsService.classInfo(id);
    this._mode = 'edit';
  }
  public searchMode(): void {
    this.advertisementForm.reset();
    this._mode = 'search';
  }
  public myMode(): void {
    this.advertisementForm.reset();
    this._mode = 'my';
  }
  private advertisementToForm(id: string, type: 'search' | 'my'): boolean {
    const list = type === 'search' ? this.advertisementsList : this.myAdvertisementsList;

    if ((!list?.advertisements || !Array.isArray(list.advertisements))
      && (!list?.archive || !Array.isArray(list.archive))) {
      return false;
    }

    const found = list.advertisements.find((ad: any) => ad.id === id) || list.archive.find((ad: any) => ad.id === id);

    if (found) {
      this.advertisementForm.patchValue({
        name: found.name || '',
        price: found.price ?? '',
        description: found.description || ''
      });
      this.selectedAdvertisementID = id;
      this.selectedAdvertisementUsername = found.username;
      return true;
    }

    return false;
  }

  constructor(
    public auth: AuthService,
    private advertisementsService: AdvertisementsService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isAuth$ = this.auth.token$.pipe(map(t => !!t));
    this.isBrowser = isPlatformBrowser(this.platformId);

    this.advertisements$ = this.advertisementsService.advertisements$;
    this.myAdvertisements$ = this.advertisementsService.myAdvertisements$;
    this.myCreatedClasses$ = this.advertisementsService.myCreatedClasses$;


    this.advertisementForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      price: ['', [Validators.min(1), Validators.max(1000000)]],
      description: ['', [Validators.maxLength(500)]]
    });
    this.selectClassForm = this.fb.group({
      link: ['', [Validators.required]]
    });
    this.searchForm = this.fb.group({
      value: ['', []]
    });
  }


  ngOnInit(): void {
    this.advertisementsService.clearState();
    this.advertisementsService.refresh(this.searchForm.value.value ?? '');

    this.advertisements$.subscribe(response => this.advertisementsList = response);
    this.myAdvertisements$.subscribe(response => this.myAdvertisementsList = response);
    this.myCreatedClasses$.subscribe(response => this.myCreatedClassesList = response);
  }
  ngOnDestroy(): void {
    this.searchForm.reset();
    this.advertisementsService.pageIndex = 0;
    this.advertisementsService.loadAdvertisements('').subscribe();
  }
  public submitAdvertisementForm(): void {
    const chosenLink = this.selectClassForm.get('link')?.value;
    if (this._mode == null || !this.advertisementForm.valid) return;
    this.advertisementsService.submitForm(this.advertisementForm, this.selectedAdvertisementID, this._mode, chosenLink)
      .subscribe({
        next: (response) => {
          if (response?.message) this.openSnackBar(response.message);
          this.myMode();
        },
        error: () => this.myMode()
      });
  }

  public archiveAdvertisement(): void {
    if (!this.selectedAdvertisementID) return;
    this.advertisementsService.archiveAdvertisement(this.selectedAdvertisementID)
      .subscribe({
        next: (response) => {
          if (response?.message) this.openSnackBar(response.message);
          this.myMode();
        },
        error: () => this.myMode()
      });
  }
  public removeAdvertisement(): void {
    if (!this.selectedAdvertisementID) return;
    this.advertisementsService.removeAdvertisement(this.selectedAdvertisementID)
      .subscribe({
        next: (response) => {
          if (response?.message) this.openSnackBar(response.message);
          this.myMode();
        },
        error: () => this.myMode()
      });
  }

  public get pageIndex(): number { return this.advertisementsService.pageIndex }
  public get PAGE_SIZE(): number { return this.advertisementsService.PAGE_SIZE }
  handlePageEvent(e: PageEvent) {
    this.advertisementsService.pageIndex = e.pageIndex;
    this.advertisementsService.loadAdvertisements(this.searchForm.value.value).subscribe({
      next: (response) => {
        this.cdr.detectChanges();
      }
    });
  }
  public search(): void {
    this.advertisementsService.pageIndex = 0;
    this.advertisementsService.loadAdvertisements(this.searchForm.value.value).subscribe({
      next: (response) => {
        this.cdr.detectChanges();
      }
    });;
  }
}
