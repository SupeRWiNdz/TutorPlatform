import { ChangeDetectionStrategy, Component, Inject, inject, PLATFORM_ID, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: '../user.scss',
  imports: [ReactiveFormsModule, CommonModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
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
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.form.pending || this.form.invalid) {
      return;
    }

    const { email, password } = this.form.value;

    this.dataService.sessionDS.login(email, password).pipe(
      catchError(error => {
        this.openSnackBar(error.error?.message || 'Ошибка при входе');
        return of(null);
      })
    ).subscribe({
      next: (response) => {
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