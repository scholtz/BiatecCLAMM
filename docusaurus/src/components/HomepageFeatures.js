import React from 'react';
import clsx from 'clsx';
import Translate from '@docusaurus/Translate';
import styles from './HomepageFeatures.module.css';

function Feature({ title, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <h3><Translate id={title.id}>{title.defaultMessage}</Translate></h3>
        <p><Translate id={description.id}>{description.defaultMessage}</Translate></p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  const FeatureList = [
    {
      title: {
        id: 'features.concentratedLiquidity.title',
        defaultMessage: 'Concentrated Liquidity',
      },
      description: {
        id: 'features.concentratedLiquidity.description',
        defaultMessage: 'Efficiently provide liquidity within custom price ranges to maximize capital utilization and earning potential.',
      },
    },
    {
      title: {
        id: 'features.algorandNative.title',
        defaultMessage: 'Algorand Native',
      },
      description: {
        id: 'features.algorandNative.description',
        defaultMessage: 'Built specifically for Algorand blockchain with optimized smart contracts and seamless integration.',
      },
    },
    {
      title: {
        id: 'features.stakingPools.title',
        defaultMessage: 'Staking Pools',
      },
      description: {
        id: 'features.stakingPools.description',
        defaultMessage: 'Earn rewards by staking assets in specialized pools with automated yield distribution.',
      },
    },
    {
      title: {
        id: 'features.identityCompliance.title',
        defaultMessage: 'Identity Compliance',
      },
      description: {
        id: 'features.identityCompliance.description',
        defaultMessage: 'Integrated identity verification system ensuring regulatory compliance and secure transactions.',
      },
    },
    {
      title: {
        id: 'features.flexibleFeeManagement.title',
        defaultMessage: 'Flexible Fee Management',
      },
      description: {
        id: 'features.flexibleFeeManagement.description',
        defaultMessage: 'Configurable fee structures with automatic distribution between liquidity providers and protocol.',
      },
    },
    {
      title: {
        id: 'features.developerSdk.title',
        defaultMessage: 'Developer SDK',
      },
      description: {
        id: 'features.developerSdk.description',
        defaultMessage: 'Comprehensive TypeScript SDK for easy integration and development of DeFi applications.',
      },
    },
  ];

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
