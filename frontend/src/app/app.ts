import { Component, signal, ViewEncapsulation } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { Location, NgStyle } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { NavButtons } from "@pages/#sideblocks/nav-buttons/nav-buttons";
import { UserInfo } from '@pages/#sideblocks/user-info/user-info';
import { NavBottom } from '@pages/#sideblocks/nav-bottom/nav-bottom';
import { NearLesson } from '@pages/#sideblocks/near-lesson/near-lesson';
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, UserInfo, RouterModule, MatButtonModule,
    NavButtons, NavBottom,
    NearLesson
],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
  constructor(
    public router: Router,
    private location: Location,
    public auth: AuthService
  ) {}
  goBack(): void {
    this.location.back();
  }
}
