import { Component, signal, ViewEncapsulation } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Location } from '@angular/common';
import { Header } from '../pages/#navigation/header/header';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Header
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
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
