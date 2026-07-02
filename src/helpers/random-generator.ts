import { Injectable } from '@nestjs/common';

@Injectable()
export class Helpers {
  randomStringGen(length: number): string {
    const pass = 'qwertyuopasdfghjklzxcvbnmQWERTYUOPASDFGHJKLZXCVBNM234567890';
    return Array(length)
      .fill(pass)
      .map((x) => x[Math.floor(Math.random() * x.length)])
      .join('');
  }

  randomNumberGen(length: number): number {
    const availableNumbers = '0123456789';
    return Number(
      Array(length)
        .fill(availableNumbers)
        .map((x) => x[Math.floor(Math.random() * x.length)])
        .join(''),
    );
  }

  generateOTP(length: number): string {
    const availableNumbers = '0123456789';
    return Array(length)
      .fill(availableNumbers)
      .map((x) => x[Math.floor(Math.random() * x.length)])
      .join('');
  }

  generateOrderReference() {
    const digits = this.randomNumberGen(7);
    return `DRV-ORD${digits}`;
  }
  generateTxReference() {
    const digits = this.randomNumberGen(7);
    return `DRVTRX${digits}`;
  }

  generateAccountNumber() {
    return String(this.randomNumberGen(10));
  }

  generateWalletId() {
    const chars = this.randomStringGen(3).toUpperCase();
    const digits = this.randomNumberGen(4);
    return `KMT${chars}${digits}`;
  }
}
