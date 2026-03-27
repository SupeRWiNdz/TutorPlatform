import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
@Component({
  selector: 'app-main',
  imports: [RouterModule, MatButtonModule,
    MatIcon
  ],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {


  constructor(
    public router: Router
  ) {
  }
}
