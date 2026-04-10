import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-week-lessons',
  imports: [CommonModule, RouterModule,
    MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './week-lessons.html',
  styleUrl: './week-lessons.scss',
})
export class WeekLessons implements OnInit{
  
  constructor() {}

  ngOnInit(): void {
  }
}
