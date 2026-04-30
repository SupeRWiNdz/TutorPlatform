import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, Observable, of, Subject, takeUntil } from 'rxjs';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MatMenuModule } from '@angular/material/menu';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-account',
  imports: [CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatMenuModule, MatDatepickerModule, TruncatePipe],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account {
  user: any | null = null;
  editForm: FormGroup;
  passwordForm: FormGroup;
  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
  public sessions$: Observable<any> = of(null);
  private _mode: 'edit' | 'password' | 'sessions' | null = null;
  public get mode() { return this._mode; }
  public isTitleActive: number = 50;
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {
    this.passwordForm = this.fb.group({
      old_password: ['', [Validators.required]],
      new_password: ['', Validators.required]
    });
    this.editForm = this.fb.group({
      new_email: ['', []],
      new_phone: ['', []],
      new_username: ['', []],
      new_birth_date: ['', []],
      new_full_name: ['', []]
    });

  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.user = data['account'] ?? null;
      if (!this.user) return;
      this.authService.loadSessions();
      this.sessions$ = this.authService.sessions$;

      this.editForm.patchValue({
        new_email: this.user.email ?? '',
        new_phone: this.user.phone ?? '',
        new_username: this.user.username ?? '',
        new_birth_date: this.user.birth_date ?? '',
        new_full_name: this.user.full_name ?? ''
      });
    });
  }

  logout(): void {
    this.authService.logout();
  }

  closeOtherSessions(): void {
    this.authService.closeOtherSessions();
  }

  changePassword(): void {
    const { tokenValue: sessionId } = this.authService;
    if (!sessionId) {
      this.router.navigate(['/login']);
      return;
    }
    if (this.passwordForm.pending || this.passwordForm.invalid) {
      this.openSnackBar('Введите старый и новый пароли');
      return;
    }
    const { old_password, new_password } = this.passwordForm.value;
    this.dataService.userDS.changePassword(sessionId, old_password, new_password).pipe(
      catchError(error => {
        this.openSnackBar(error.error?.message || 'Ошибка смены пароля');
        this.cdr.detectChanges();
        return of(null);
      })
    ).subscribe({
      next: (response: any) => {
        if (response.message)
          this.openSnackBar(response.message);

        if (response) {
          if (response.session_id)
            this.authService.setTokenToStorage(response.session_id);
          this.passwordForm.reset();
          this.authService.loadUserData();
        }
      }
    });
  }
  public editUser(): void {
    const { tokenValue: sessionId } = this.authService;
    if (!sessionId || this.editForm.pending || this.editForm.invalid) return;

    const { new_email, new_phone, new_username, new_birth_date, new_full_name } = this.editForm.value;

    const requestData = {
      session_id: sessionId,
      ...((new_email && new_email !== this.user.email) ? { new_email } : {}),
      ...((new_username && new_username !== this.user.username) ? { new_username } : {}),
      ...((new_full_name && new_full_name !== this.user.full_name) ? { new_full_name } : {}),
      ...((new_phone && new_phone !== this.user.phone) ? { new_phone } : {}),
      ...((new_birth_date && new_birth_date !== this.user.birth_date) ? { new_birth_date } : {})
    };

    this.dataService.userDS
      .editUser(requestData)
      .pipe(
        catchError(error => {
          this.openSnackBar(error?.error?.message || 'Ошибка обновления профиля');
          this.cdr.detectChanges();
          return of(null);
        })
      )
      .subscribe((response: any) => {
        if (!response?.changed_fields) return;
        if (response.message)
          this.openSnackBar(response.message);

        const cf = response.changed_fields;

        if (cf.email !== undefined) this.user.email = cf.email;
        if (cf.username !== undefined) this.user.username = cf.username;
        if (cf.full_name !== undefined) this.user.full_name = cf.full_name;
        if (cf.phone !== undefined) this.user.phone = cf.phone;
        if (cf.birth_date !== undefined) this.user.birth_date = cf.birth_date;

        this.noMode()
        this.authService.loadUserData();
        this.route.data = of({ account: this.user });
        this.cdr.detectChanges();
      });
  }

  public editMode(): void { this._mode = 'edit'; }
  public passwordMode(): void { this._mode = 'password'; }
  public noMode(): void {
    this.passwordForm.reset();
    this.editForm.patchValue({
      new_email: this.user.email ?? '',
      new_phone: this.user.phone ?? '',
      new_username: this.user.username ?? '',
      new_birth_date: this.user.birth_date ?? '',
      new_full_name: this.user.full_name ?? ''
    });
    this._mode = null;
  }
  public sessionsMode(): void {
    this._mode = 'sessions';
  };

  hideOldPassword = signal(true);
  hideNewPassword = signal(true);

  toggleOldPassword(event: MouseEvent): void {
    this.hideOldPassword.set(!this.hideOldPassword());
    event.stopPropagation();
  }

  toggleNewPassword(event: MouseEvent): void {
    this.hideNewPassword.set(!this.hideNewPassword());
    event.stopPropagation();
  }
  public showTitle(): void {
    if (this.isTitleActive == 50)
      this.isTitleActive = -1;
    else
      this.isTitleActive = 50;
  }
}
