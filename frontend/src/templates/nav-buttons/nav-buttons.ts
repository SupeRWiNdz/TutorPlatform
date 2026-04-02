import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { filter } from 'rxjs';

@Component({
  selector: 'nav-buttons',
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './nav-buttons.html',
  styleUrl: './nav-buttons.scss'
})
export class NavButtons {
  currentRoute: string = '';
  
  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.urlAfterRedirects;
    });
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