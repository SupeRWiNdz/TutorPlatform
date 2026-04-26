import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs/internal/Observable';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@services/auth.service';
import { TruncatePipe } from '@pipes/truncate.pipe';

@Component({
  selector: 'user-info',
  imports: [CommonModule, RouterModule, TruncatePipe,
    MatIconModule, MatButtonModule
  ],
  templateUrl: './user-info.html',
  styleUrl: './user-info.scss',
})
export class UserInfo {

  currentUser$: Observable<any | null>;
  
  constructor(
    public authService: AuthService,
    public router: Router
  ) {
    this.currentUser$ = this.authService.currentUser$;
  }
}
