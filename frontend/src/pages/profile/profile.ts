import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit{
  user: any | null = null;  
  
  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.user = data['profile'];
    });
  }

}
