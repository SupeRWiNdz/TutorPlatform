import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TruncatePipe } from "@pipes/truncate.pipe";
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, RouterModule,
    MatButtonModule, MatIconModule, TruncatePipe, MatMenuModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit{
  user: any | null = null;  
  public isTitleActive: number = 50;
  
  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.user = data['profile'];
    });
  }
  public showTitle(): void {
    if (this.isTitleActive == 50)
      this.isTitleActive = -1;
    else
      this.isTitleActive = 50;
  }
}
