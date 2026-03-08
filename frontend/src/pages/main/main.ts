import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-main',
  imports: [RouterModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main {

  constructor(
    public router: Router
  ) {
  }
}
