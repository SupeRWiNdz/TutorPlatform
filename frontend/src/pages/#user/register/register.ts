import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, CommonModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class RegisterComponent {
  form: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private dataService: DataService,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: [''],
      username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
      birth_date: ['', [Validators.pattern(/^\d{2}\.\d{2}\.\d{4}$/)]],
      full_name: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    
  if (this.form.invalid) {
    const controls = [
      { name: 'email', control: this.form.get('email') },
      { name: 'password', control: this.form.get('password') },
      { name: 'username', control: this.form.get('username') },
      { name: 'full_name', control: this.form.get('full_name') },
      { name: 'birth_date', control: this.form.get('birth_date') }
    ];

    for (const { name, control } of controls) {
      if (control?.errors) {
        this.setErrorMessage(name, control.errors);
        return;
      }
    }
    
    this.errorMessage = 'Заполните все обязательные поля корректно';
    return;
  }

    this.isLoading = true;
    this.errorMessage = '';

    const formData = {
      email: this.form.value.email,
      password: this.form.value.password,
      username: this.form.value.username,
      full_name: this.form.value.full_name,
      phone: this.form.value.phone || undefined,
      birth_date: this.form.value.birth_date || undefined
    };

    this.dataService.userDS.register(formData).pipe(
      catchError(error => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Ошибка при регистрации';
        return of(null);
      })
    ).subscribe({
      next: (response:any) => {
        this.isLoading = false;
        if (response && response.session_id) {
          this.authService.setTokenToStorage(response.session_id);
          this.authService.getUserBySessionId(response.session_id).subscribe(() => {
            this.router.navigate(['/']);
          });
        }
      }
    });
  }

  private setErrorMessage(fieldName: string, errors: any): void {
  switch (fieldName) {
    case 'email':
      this.errorMessage = errors['required'] 
        ? 'Введите email' 
        : 'Введите корректный email';
      break;
    case 'password':
      this.errorMessage = errors['required']
        ? 'Введите пароль'
        : 'Пароль должен содержать минимум 6 символов';
      break;
    case 'username':
      if (errors['required']) {
        this.errorMessage = 'Введите имя пользователя';
      } else if (errors['minlength']) {
        this.errorMessage = 'Имя пользователя должно быть минимум 3 символа';
      } else if (errors['pattern']) {
        this.errorMessage = 'Имя пользователя может содержать только буквы, цифры и подчеркивание';
      }
      break;
    case 'full_name':
      this.errorMessage = 'Введите полное имя';
      break;
    case 'birth_date':
      this.errorMessage = 'Дата рождения должна быть в формате ДД.ММ.ГГГГ';
      break;
  }
}

  get email() { return this.form.get('email'); }
  get password() { return this.form.get('password'); }
  get username() { return this.form.get('username'); }
  get full_name() { return this.form.get('full_name'); }
  get birth_date() { return this.form.get('birth_date'); }
  get phone() { return this.form.get('phone'); }

  hide = signal(true);
  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }
}