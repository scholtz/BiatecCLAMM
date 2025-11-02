import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Concentrated Liquidity',
    description: (
      <>Experience the power of concentrated liquidity AMM on Algorand. Provide liquidity within custom price ranges to earn higher yields and reduce impermanent loss compared to traditional AMMs.</>
    ),
  },
  {
    title: 'Algorand Native',
    description: (
      <>Built specifically for Algorand blockchain with optimized smart contracts. Leverage Algorand&apos;s speed, security, and low transaction costs for efficient decentralized trading.</>
    ),
  },
  {
    title: 'Staking Pools',
    description: <>Create and manage staking pools for interest-bearing tokens. Support for both same-asset staking (B-ALGO, B-USDC) and traditional asset pairs with automated reward distribution.</>,
  },
  {
    title: 'Identity & Compliance',
    description: <>Integrated identity verification system with configurable verification classes. Enable KYC-compliant trading while maintaining decentralization and privacy.</>,
  },
  {
    title: 'Flexible Fee Management',
    description: <>Configurable fee structure with Biatec fee sharing. Liquidity providers earn from trading fees while the protocol collects a sustainable share for ecosystem development.</>,
  },
  {
    title: 'Developer SDK',
    description: <>Comprehensive TypeScript SDK with transaction builders, sender functions, and utilities. Easy integration for dApps, wallets, and trading interfaces with full type safety.</>,
  },
];

function Feature({ title, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
