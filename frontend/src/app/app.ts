import { Component, signal, ViewEncapsulation } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { NavButtons } from "src/templates/nav-buttons/nav-buttons";
import { UserInfo } from '@templates/user-info/user-info';
import { NavBottom } from '@templates/nav-bottom/nav-bottom';
import { NextLesson } from "@templates/next-lesson/next-lesson";

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, UserInfo, RouterModule, MatButtonModule,
    NavButtons, NavBottom,
    NextLesson
],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
  constructor(
    public router: Router,
    private location: Location
  ) {}
  goBack(): void {
    this.location.back();
  }
}
