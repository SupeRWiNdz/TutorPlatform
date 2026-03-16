import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data-service/data.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [ReactiveFormsModule, CommonModule, RouterModule]
})
export class LoginComponent {
  form: FormGroup;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private dataService: DataService,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.form.pending || this.form.invalid) {
      this.errorMessage = 'Введите email и пароль';
      return;
    }

    const { email, password } = this.form.value;
    this.errorMessage = '';

    this.dataService.sessionDS.login(email, password).pipe(
      catchError(error => {
        this.errorMessage = error.error?.message || 'Ошибка при входе';
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
}