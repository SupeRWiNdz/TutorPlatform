import { Component } from '@angular/core';
import { NavButtons } from "@templates/nav-buttons/nav-buttons";

@Component({
  selector: 'app-main',
  imports: [
    NavButtons
],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {


  constructor(
  ) {
  }
}
