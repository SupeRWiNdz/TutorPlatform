import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Inject, PLATFORM_ID, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, CommonModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatButtonToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: '../user.scss',
})
export class RegisterComponent {
  form: FormGroup;
  isBrowser: boolean;
  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  constructor(
    private fb: FormBuilder,
    private dataService: DataService,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.form = this.fb.group({
      account_type: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      repeat_password: ['', [Validators.required, Validators.minLength(6)]],
      phone: [''],
      username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
      birth_date: ['', [Validators.pattern(/^\d{2}\.\d{2}\.\d{4}$/)]],
      full_name: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    const formData = {
      account_type: this.form.value.account_type,
      email: this.form.value.email,
      password: this.form.value.password,
      repeat_password: this.form.value.repeat_password,
      username: this.form.value.username,
      full_name: this.form.value.full_name,
      phone: this.form.value.phone || undefined,
      birth_date: this.form.value.birth_date || undefined
    };
    console.log(formData);
    if (formData.password !== formData.repeat_password) { return; }

    this.dataService.userDS.register(formData).pipe(
      catchError(error => {
        this.openSnackBar(error.error?.message || 'Ошибка при регистрации');
        return of(null);
      })
    ).subscribe({
      next: (response: any) => {
        if (response && response.session_id) {
          this.authService.setTokenToStorage(response.session_id);
          this.authService.getUserBySessionId(response.session_id).subscribe(() => {
            this.router.navigate(['/']);
          });
        }
      }
    });
  }

  hide = signal(true);
  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }
}