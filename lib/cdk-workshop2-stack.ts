import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets'
import * as rds from 'aws-cdk-lib/aws-rds'
import { Construct } from 'constructs'
import { readFileSync } from 'fs'

export class CdkWorkshop2Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const vpc = new ec2.Vpc(this, 'BlogVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
    })

    const webServer1 = new ec2.Instance(this, 'WordpressServer1', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    })

    const script = readFileSync('./lib/resources/user-data.sh', 'utf8')
    webServer1.addUserData(script)

    // webServer1.connections.allowFromAnyIpv4(ec2.Port.tcp(80))

    new CfnOutput(this, 'WordPressServer1PublicIPAdress', {
      value: `http://${webServer1.instancePublicIp}`,
    })

    const dbServer = new rds.DatabaseInstance(this, 'WordPressDB', {
      vpc,
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_31 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL),
      databaseName: 'wordpress',
    })

    dbServer.connections.allowDefaultPortFrom(webServer1)

    const alb = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
    })

    const listener = alb.addListener('listener', {
      port: 80,
    })

    listener.addTargets('ApplicationFleet', {
      port: 80,
      targets: [new targets.InstanceTarget(webServer1, 80)],
      healthCheck: {
        path: '/wp-includes/images/blank.gif',
      },
    })

    webServer1.connections.allowFrom(alb, ec2.Port.tcp(80))
  }
}
