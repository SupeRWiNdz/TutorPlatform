import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'next-lesson',
  imports: [CommonModule, RouterModule,
    MatIconModule, MatButtonModule
  ],
  templateUrl: './next-lesson.html',
  styleUrl: './next-lesson.scss',
})
export class NextLesson {
  
  constructor(
  ) {
  }
}
