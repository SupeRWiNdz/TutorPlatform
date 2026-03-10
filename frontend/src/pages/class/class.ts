import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-class',
  imports: [],
  templateUrl: './class.html',
  styleUrl: './class.css',
})

export class Class implements OnInit{
  class: any | null = null;  
  
  constructor(private route: ActivatedRoute,
              private router: Router) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.class = data['class'];
    });
  }
    navigateToChat(username: string) {
    this.router.navigate(['/chat', username]);
  }

}
