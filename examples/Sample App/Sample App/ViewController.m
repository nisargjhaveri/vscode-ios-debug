//
//  ViewController.m
//  Sample App
//
//  Created by Nisarg Jhaveri on 30/08/21.
//

#import "ViewController.h"
#import "Sample_App-Swift.h"

@interface ViewController ()

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    // Do any additional setup after loading the view.

    fprintf(stderr, "Objc fprintf\n");
    NSLog(@"Objc NSLog");
    [[Logging alloc] trylog];
}


@end
