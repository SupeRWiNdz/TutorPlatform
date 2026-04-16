import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { MinutesToReadablePipe } from "@pipes/minutes-to-readable.pipe";
import { TruncatePipe } from "../../pipes/truncate.pipe";

@Component({
  selector: 'near-lesson',
  imports: [CommonModule, RouterModule,
    MatIconModule, MatButtonModule, MinutesToReadablePipe, TruncatePipe],
  templateUrl: './near-lesson.html',
  styleUrl: './near-lesson.scss',
})
export class NearLesson implements OnInit {
  lesson: any | null = null;
  constructor(
    public auth: AuthService,
    public dataService: DataService
  ) {
  }
  ngOnInit(): void {
    const token = this.auth.tokenValue;
    if (!token) { return; }
    this.dataService.lessonsDS.getNearest(token).subscribe({
      next: (response) => {
        this.lesson = response.lesson;
      }
    });
  }
}
