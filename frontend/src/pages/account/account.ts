import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data-service/data.service';

@Component({
  selector: 'app-account',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  form: FormGroup;
  errorMessage: string = '';
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private dataService: DataService
  ) {
    this.form = this.fb.group({
      old_password: ['', [Validators.required]],
      new_password: ['', Validators.required]
    });}

  
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  closeOtherSessions(): void {
    this.authService.closeOtherSessions();
  }

  changePassword(old_password: string, new_password: string): void {
  const token: string | null = this.authService.tokenValue;
  if (!token) {
    this.router.navigate(['/login']);
    return;
  }
  
  this.errorMessage = '';
  
  this.dataService.userDS.changePassword(token, old_password, new_password).pipe(
    catchError(error => {
      this.errorMessage = error.error?.message || 'Ошибка смены пароля';
      return of(null);
    })
  ).subscribe({
    next: (response: any) => {
      
      if (response) {
        if (response.session_id)
          this.authService.setTokenToStorage(response.session_id);
        this.form.reset();
        this.authService.loadUserData();
      }
    }
  });
  }

  onSubmit(): void {
    if (this.form.pending || this.form.invalid) {
      this.errorMessage = 'Введите старый и новый пароли';
      return;
    }
    const { old_password, new_password } = this.form.value;
    this.errorMessage = '';
    this.changePassword(old_password, new_password);
  }
}
