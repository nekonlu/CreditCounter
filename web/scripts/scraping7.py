import sys
import requests
from bs4 import BeautifulSoup
from os import chdir
from os import path
chdir(path.dirname(path.abspath(__file__)))

class Scraping:
    def __init__(self,school_id,department_id ,department_id_alpha,common_url,header,):
        self.school_id = school_id # 木更津高専のID '14'
        self.department_id = department_id
        self.department_id_alpha = department_id_alpha
        self.common_url = common_url
        self.header = header

        #year,dirをコマンドライン引数化
        args = sys.argv
        try:
            self.year = args[1]
        except:
            self.year = '2025'

        try:
            self.dir = '../data/'
        except:
            self.dir = './'

    def element_counter(self,soup,id,department,ippan_senmon,hissyu_sentaku,tanni):
        tanni_flag = False
        Q_flag = False
        for i,element in enumerate(soup.find_all('td')):
            data = element.get_text()
            if data in '1Q':
                Q_flag = True
            if not Q_flag:
                continue

            id.append( str(self.department_id_alpha[int(department)-11])+ '-' + self.year + '-' + str(i))
            if data == '一般' or data == '専門':
                ippan_senmon.append(data)

            if '必修' in data or '選択' in data:
                hissyu_sentaku.append(data)

            if '単位' in data:
                tanni_flag = True
                continue

            if tanni_flag and len(data) == 1 and data != '前' and data != '後':
                tanni.append(data)
                tanni_flag = False
    def grade_counter(self,soup,grade):
        cnm = [[] for i in range(5)]
        grade_count = 0
        cnt = 0
        for i in range(1, 6):
                class_name = 'c' + str(i) + 'm'
                for element in soup.find_all(class_=class_name):
                    name = element.get_text()
                    cnm[i-1].append(name)

        for i in range((int)(len(cnm[0]) / 4)):
                if cnm[grade_count][cnt] != '' or cnm[grade_count][cnt+1] != '' or cnm[grade_count][cnt+2] != '' or cnm[grade_count][cnt+3] != '':
                    grade.append(grade_count + 1)
                else:
                    grade_count += 1
                    grade.append(grade_count + 1)

                cnt += 4

    def write(self,id,department,subjects,grade,ippan_senmon,hissyu_sentaku,tanni):
        print(str(self.dir) + str(self.department_id_alpha[int(department)-11]) + '_' + self.year + '.csv')
        f = open(str(self.dir) + str(self.department_id_alpha[int(department)-11]) + '_' + self.year + '.csv', 'w')
        f.write('ID,教科名,学年,科目,区分,単位数\n')
        for i in range(len(subjects)):
            f.write(id[i] + ',' + subjects[i] + ',' + str(grade[i]) + ',' + ippan_senmon[i] + ',' + hissyu_sentaku[i] + ',' + tanni[i] + '\n')

    def mainloop(self):
        for department in self.department_id:
            url = self.common_url + self.school_id + '&department_id=' + department + '&year=' + self.year + ' &lang=ja'
            html = requests.get(url,headers= self.header)
            soup = BeautifulSoup(html.text, 'html.parser')

            subjects = []
            for element in soup.find_all(class_="mcc-hide"):
                name = element.get_text()
                subjects.append(name)
            id = []
            ippan_senmon = []
            hissyu_sentaku = []
            tanni = []
            self.element_counter(soup,id,department,ippan_senmon,hissyu_sentaku,tanni)


            grade = []
            self.grade_counter(soup,grade)

            self.write(id,department,subjects,grade,ippan_senmon,hissyu_sentaku,tanni)


scraping = Scraping(school_id='14',department_id=['11', '12', '13', '14', '15'],department_id_alpha=['M', 'E', 'D', 'J', 'C'],common_url='https://syllabus.kosen-k.go.jp/Pages/PublicSubjects?school_id=',header = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://syllabus.kosen-k.go.jp/'
            })

scraping.mainloop()
