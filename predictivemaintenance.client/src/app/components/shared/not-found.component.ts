// components/shared/not-found/not-found.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule],
  template: `
    <div class="not-found-container">
      <mat-card>
        <mat-card-content>
          <h1>404 - Page Not Found</h1>
          <p>The page you're looking for doesn't exist.</p>
          <a mat-raised-button color="primary" routerLink="/dashboard">
            Go to Dashboard
          </a>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .not-found-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    mat-card {
      text-align: center;
      max-width: 400px;
    }
  `]
})
export class NotFoundComponent { }
