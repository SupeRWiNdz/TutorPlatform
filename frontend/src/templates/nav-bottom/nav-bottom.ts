import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { filter, map, Observable } from 'rxjs';
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'nav-bottom',
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './nav-bottom.html',
  styleUrl: './nav-bottom.scss'
})
export class NavBottom implements OnInit {
  currentRoute: string = '';
  public isAuth$: Observable<boolean>;
  isBrowser: boolean;
  constructor(private router: Router,
    private auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.isAuth$ = this.auth.token$.pipe(
      map(token => !!token) // преобразуем token в boolean
    );

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.urlAfterRedirects;
    });
  }

  ngOnInit(): void {
    this.auth.checkActiveSession().subscribe();
  }

  isRouteActive(route: string): boolean {
    if (route === '/' && this.currentRoute === '/') {
      return true;
    }
    if (route !== '/' && this.currentRoute.startsWith(route)) {
      return true;
    }
    return false;
  }
}