import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data-service/data.service';
import { AuthService } from '../../services/auth.service';
import { MatInputModule} from '@angular/material/input'
import { MatFormFieldModule} from '@angular/material/form-field'
import { MatButtonModule } from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [ReactiveFormsModule, CommonModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  form: FormGroup;

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
    //console.log(this.form.get('email')?.errors);
    if (this.form.pending || this.form.invalid) {
      return;
    }

    const { email, password } = this.form.value;

    this.dataService.sessionDS.login(email, password).pipe(
      catchError(error => {
        //this.errorMessage = error.error?.message || 'Ошибка при входе';
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